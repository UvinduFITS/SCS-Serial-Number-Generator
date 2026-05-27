import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { exportToExcel } from '../lib/exportExcel'
import Layout from '../components/Layout'
import Button from '../components/Button'
import Input from '../components/Input'
import Select from '../components/Select'
import {
  Download, SlidersHorizontal, X, ChevronLeft, ChevronRight,
  Hash, FileText, Briefcase, Users,
} from 'lucide-react'

const SHIPMENT_OPTIONS = [
  { value: '',   label: 'All Shipment Types' },
  { value: 'AE', label: 'AE — Air Export' },
  { value: 'AI', label: 'AI — Air Import' },
  { value: 'OE', label: 'OE — Ocean Export' },
  { value: 'OI', label: 'OI — Ocean Import' },
  { value: 'WH', label: 'WH — Warehousing' },
]

const SHIPMENT_FULL = {
  AE: 'Air Export',
  AI: 'Air Import',
  OE: 'Ocean Export',
  OI: 'Ocean Import',
  WH: 'Warehousing',
}

const SHIPMENT_COLORS = {
  AE: '#2563eb', // blue
  AI: '#7c3aed', // purple
  OE: '#0891b2', // cyan
  OI: '#059669', // green
  WH: '#d97706', // amber
}

const NUMBER_TYPE_OPTIONS = [
  { value: '', label: 'All Number Types' },
  { value: 'J', label: 'Job Number' },
  { value: 'H', label: 'HAWB Number' },
]

const PAGE_SIZE = 10
const emptyFilters = { dateFrom: '', dateTo: '', userEmail: '', shipmentType: '', numberType: '' }

// ────────────────────────────────────────────────────────────
// Small sub-components
// ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color = 'blue' }) {
  const colorMap = {
    blue:   'bg-blue-50  text-blue-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber:  'bg-amber-50 text-amber-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">{label}</p>
        {Icon && (
          <div className={`p-2 rounded-lg ${colorMap[color]}`}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span className="font-semibold text-gray-800">{value.toLocaleString()}</span>
      </div>
      <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-2.5 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Main Dashboard
// ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [allRows, setAllRows]       = useState([])
  const [pageRows, setPageRows]     = useState([])
  const [activeUsers, setActiveUsers] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [exportLoading, setExportLoading] = useState(false)
  const [page, setPage] = useState(1)

  const [staged, setStaged]   = useState({ ...emptyFilters })
  const [applied, setApplied] = useState({ ...emptyFilters })

  // Build a filtered Supabase query
  function applyFilterChain(query) {
    let q = query
    if (applied.dateFrom) q = q.gte('created_at', applied.dateFrom)
    if (applied.dateTo) {
      const to = new Date(applied.dateTo)
      to.setDate(to.getDate() + 1)
      q = q.lt('created_at', to.toISOString())
    }
    if (applied.userEmail)    q = q.ilike('user_email', `%${applied.userEmail}%`)
    if (applied.shipmentType) q = q.eq('shipment_type', applied.shipmentType)
    if (applied.numberType)   q = q.eq('number_type', applied.numberType)
    return q
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch every matching row for in-memory aggregation
      let q = applyFilterChain(
        supabase.from('generated_numbers').select('*', { count: 'exact' })
      )
      q = q.order('created_at', { ascending: false })

      const { data, error, count } = await q
      if (error) throw error
      setAllRows(data ?? [])
      setTotalCount(count ?? 0)

      // Active users count (independent of filters)
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
      setActiveUsers(usersCount ?? 0)
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Slice rows for paginated audit log
  useEffect(() => {
    const start = (page - 1) * PAGE_SIZE
    setPageRows(allRows.slice(start, start + PAGE_SIZE))
  }, [allRows, page])

  // ─── Derived stats ───
  const stats = useMemo(() => {
    const jobCount  = allRows.filter(r => r.number_type === 'J').length
    const hawbCount = allRows.filter(r => r.number_type === 'H').length

    // By shipment type
    const byShipment = ['AE', 'AI', 'OE', 'OI', 'WH'].map(code => ({
      code,
      label: `${SHIPMENT_FULL[code]} (${code})`,
      count: allRows.filter(r => r.shipment_type === code).length,
      color: SHIPMENT_COLORS[code],
    }))
    const maxShipment = Math.max(...byShipment.map(b => b.count), 0)

    // By user
    const userMap = new Map()
    for (const row of allRows) {
      if (!userMap.has(row.user_email)) {
        userMap.set(row.user_email, { user_email: row.user_email, j: 0, h: 0, total: 0 })
      }
      const entry = userMap.get(row.user_email)
      if (row.number_type === 'J') entry.j++
      else if (row.number_type === 'H') entry.h++
      entry.total++
    }
    const byUser = Array.from(userMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    return { jobCount, hawbCount, byShipment, maxShipment, byUser }
  }, [allRows])

  const jobPct  = totalCount > 0 ? Math.round((stats.jobCount  / totalCount) * 100) : 0
  const hawbPct = totalCount > 0 ? Math.round((stats.hawbCount / totalCount) * 100) : 0
  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE))
  const hasActiveFilters = Object.values(applied).some(Boolean)

  function applyFilters() {
    setApplied({ ...staged })
    setPage(1)
  }
  function clearFilters() {
    setStaged({ ...emptyFilters })
    setApplied({ ...emptyFilters })
    setPage(1)
  }

  async function handleExport() {
    setExportLoading(true)
    try {
      const now = new Date()
      const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
      exportToExcel(allRows, `SCS_Log_${ym}.xlsx`)
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-5">
        {/* ─── Header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              SCS Serial Number Generator — Admin Dashboard
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {hasActiveFilters ? 'Filtered view' : 'All-time log'} · Administrator view only
            </p>
          </div>
          <Button onClick={handleExport} loading={exportLoading} className="shrink-0">
            <Download size={15} />
            Export to Excel
          </Button>
        </div>

        {/* ─── Filters Bar ────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-4">
            <SlidersHorizontal size={15} />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                Active
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <Input
              label="Date From"
              type="date"
              value={staged.dateFrom}
              onChange={(e) => setStaged(f => ({ ...f, dateFrom: e.target.value }))}
            />
            <Input
              label="Date To"
              type="date"
              value={staged.dateTo}
              onChange={(e) => setStaged(f => ({ ...f, dateTo: e.target.value }))}
            />
            <Input
              label="User Name / Email"
              type="text"
              value={staged.userEmail}
              onChange={(e) => setStaged(f => ({ ...f, userEmail: e.target.value }))}
              placeholder="Search email…"
            />
            <Select
              label="Shipment Type"
              value={staged.shipmentType}
              onChange={(e) => setStaged(f => ({ ...f, shipmentType: e.target.value }))}
              options={SHIPMENT_OPTIONS}
            />
            <Select
              label="Number Type"
              value={staged.numberType}
              onChange={(e) => setStaged(f => ({ ...f, numberType: e.target.value }))}
              options={NUMBER_TYPE_OPTIONS}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={applyFilters}>Apply Filters</Button>
            <Button onClick={clearFilters} variant="secondary">
              <X size={13} />
              Clear
            </Button>
          </div>
        </div>

        {/* ─── 4 Stat Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Generated"
            value={totalCount}
            sub={hasActiveFilters ? 'Filtered' : 'All time'}
            icon={Hash}
            color="blue"
          />
          <StatCard
            label="Job Numbers (J)"
            value={stats.jobCount}
            sub={`${jobPct}% of total`}
            icon={Briefcase}
            color="purple"
          />
          <StatCard
            label="HAWB Numbers (H)"
            value={stats.hawbCount}
            sub={`${hawbPct}% of total`}
            icon={FileText}
            color="green"
          />
          <StatCard
            label="Active Users"
            value={activeUsers}
            sub="Operations team"
            icon={Users}
            color="amber"
          />
        </div>

        {/* ─── Two-Column Charts ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bar chart: by shipment type */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">
              Numbers Generated by Shipment Type
            </h3>
            {loading ? (
              <div className="text-center py-6 text-gray-400 text-sm">Loading…</div>
            ) : stats.maxShipment === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">No data</div>
            ) : (
              stats.byShipment.map(b => (
                <BarRow
                  key={b.code}
                  label={b.label}
                  value={b.count}
                  max={stats.maxShipment}
                  color={b.color}
                />
              ))
            )}
          </div>

          {/* Generated by User table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">
              Generated by User (Top 10)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="text-xs uppercase tracking-wide text-gray-400 font-medium pb-2">User</th>
                    <th className="text-xs uppercase tracking-wide text-gray-400 font-medium pb-2">Job (J)</th>
                    <th className="text-xs uppercase tracking-wide text-gray-400 font-medium pb-2">HAWB (H)</th>
                    <th className="text-xs uppercase tracking-wide text-gray-400 font-medium pb-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={4} className="text-center py-4 text-gray-400">Loading…</td></tr>
                  ) : stats.byUser.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-4 text-gray-400">No data</td></tr>
                  ) : (
                    stats.byUser.map(u => (
                      <tr key={u.user_email}>
                        <td className="py-2 text-gray-700 truncate max-w-xs">{u.user_email}</td>
                        <td className="py-2">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                            {u.j}
                          </span>
                        </td>
                        <td className="py-2">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            {u.h}
                          </span>
                        </td>
                        <td className="py-2 font-bold text-gray-900">{u.total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─── Audit Log ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">Audit Log</h3>
            <p className="text-xs text-gray-400">
              {allRows.length.toLocaleString()} record{allRows.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-semibold">Date &amp; Time</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-semibold">User</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-semibold">Shipment Type</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-semibold">Number Type</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-semibold">Reference Number</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                        Loading logs…
                      </div>
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-400">No records match your filters.</td>
                  </tr>
                ) : (
                  pageRows.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{log.user_email}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {SHIPMENT_FULL[log.shipment_type]} ({log.shipment_type})
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            log.number_type === 'J'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {log.number_type === 'J' ? 'Job' : 'HAWB'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {log.reference_number}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500">
                Showing{' '}
                <span className="font-medium">{((page - 1) * PAGE_SIZE) + 1}</span>–
                <span className="font-medium">{Math.min(page * PAGE_SIZE, allRows.length)}</span>{' '}
                of <span className="font-medium">{allRows.length.toLocaleString()}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-medium text-gray-700 px-2">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
