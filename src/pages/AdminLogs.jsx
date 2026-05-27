import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { exportToExcel } from '../lib/exportExcel'
import Layout from '../components/Layout'
import Button from '../components/Button'
import Input from '../components/Input'
import Select from '../components/Select'
import { Download, SlidersHorizontal, X, ChevronLeft, ChevronRight, FileText } from 'lucide-react'

const SHIPMENT_OPTIONS = [
  { value: '', label: 'All Shipment Types' },
  { value: 'AE', label: 'AE — Air Export' },
  { value: 'AI', label: 'AI — Air Import' },
  { value: 'OE', label: 'OE — Ocean Export' },
  { value: 'OI', label: 'OI — Ocean Import' },
  { value: 'WH', label: 'WH — Warehousing' },
]

const NUMBER_TYPE_OPTIONS = [
  { value: '', label: 'All Number Types' },
  { value: 'J', label: 'Job Number' },
  { value: 'H', label: 'HAWB Number' },
]

const PAGE_SIZE = 20

const SHIPMENT_COLORS = {
  AE: 'bg-blue-100 text-blue-700',
  AI: 'bg-indigo-100 text-indigo-700',
  OE: 'bg-amber-100 text-amber-700',
  OI: 'bg-orange-100 text-orange-700',
  WH: 'bg-purple-100 text-purple-700',
}

const emptyFilters = {
  dateFrom: '',
  dateTo: '',
  userEmail: '',
  shipmentType: '',
  numberType: '',
}

export default function AdminLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [exportLoading, setExportLoading] = useState(false)

  // staged filters (form state) vs applied filters (query state)
  const [staged, setStaged] = useState({ ...emptyFilters })
  const [applied, setApplied] = useState({ ...emptyFilters })

  function buildQuery(base) {
    let q = base
    if (applied.dateFrom) q = q.gte('created_at', applied.dateFrom)
    if (applied.dateTo) {
      const to = new Date(applied.dateTo)
      to.setDate(to.getDate() + 1)
      q = q.lt('created_at', to.toISOString())
    }
    if (applied.userEmail) q = q.ilike('user_email', `%${applied.userEmail}%`)
    if (applied.shipmentType) q = q.eq('shipment_type', applied.shipmentType)
    if (applied.numberType) q = q.eq('number_type', applied.numberType)
    return q
  }

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      let q = buildQuery(
        supabase.from('generated_numbers').select('*', { count: 'exact' })
      )
      q = q.order('created_at', { ascending: false })
      const from = (page - 1) * PAGE_SIZE
      q = q.range(from, from + PAGE_SIZE - 1)

      const { data, error, count } = await q
      if (error) throw error
      setLogs(data ?? [])
      setTotalCount(count ?? 0)
    } catch (err) {
      console.error('Fetch logs error:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, page])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

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
      let q = buildQuery(
        supabase.from('generated_numbers').select('*')
      )
      q = q.order('created_at', { ascending: false })
      const { data, error } = await q
      if (error) throw error

      const now = new Date()
      const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
      exportToExcel(data, `SCS_Log_${ym}.xlsx`)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExportLoading(false)
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const hasActiveFilters = Object.values(applied).some(Boolean)

  return (
    <Layout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-gray-500 shrink-0" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {totalCount.toLocaleString()} record{totalCount !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>
          <Button
            onClick={handleExport}
            loading={exportLoading}
            variant="secondary"
            className="shrink-0"
          >
            <Download size={15} />
            Export Excel
          </Button>
        </div>

        {/* Filter panel */}
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
              onChange={(e) => setStaged((f) => ({ ...f, dateFrom: e.target.value }))}
            />
            <Input
              label="Date To"
              type="date"
              value={staged.dateTo}
              onChange={(e) => setStaged((f) => ({ ...f, dateTo: e.target.value }))}
            />
            <Input
              label="User Email"
              type="text"
              value={staged.userEmail}
              onChange={(e) => setStaged((f) => ({ ...f, userEmail: e.target.value }))}
              placeholder="Search email…"
            />
            <Select
              label="Shipment Type"
              value={staged.shipmentType}
              onChange={(e) => setStaged((f) => ({ ...f, shipmentType: e.target.value }))}
              options={SHIPMENT_OPTIONS}
            />
            <Select
              label="Number Type"
              value={staged.numberType}
              onChange={(e) => setStaged((f) => ({ ...f, numberType: e.target.value }))}
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

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Date &amp; Time</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">User</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Shipment Type</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Number Type</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Reference Number</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                        Loading logs…
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400">
                      No records match your filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                        {log.user_email}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            SHIPMENT_COLORS[log.shipment_type] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {log.shipment_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {log.number_type_label}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap tracking-wide">
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
                <span className="font-medium">{Math.min(page * PAGE_SIZE, totalCount)}</span>{' '}
                of <span className="font-medium">{totalCount.toLocaleString()}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-medium text-gray-700 px-2">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
