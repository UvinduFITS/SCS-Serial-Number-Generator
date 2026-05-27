import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import Button from '../components/Button'
import Select from '../components/Select'
import { Copy, CheckCircle2, AlertCircle, Hash } from 'lucide-react'

const SHIPMENT_TYPES = [
  { value: 'AE', label: 'AE — Air Export' },
  { value: 'AI', label: 'AI — Air Import' },
  { value: 'OE', label: 'OE — Ocean Export' },
  { value: 'OI', label: 'OI — Ocean Import' },
  { value: 'WH', label: 'WH — Warehousing' },
]

const NUMBER_TYPES = [
  { value: 'J', label: 'Job Number' },
  { value: 'H', label: 'HAWB Number' },
]

export default function GenerateNumber() {
  const [shipmentType, setShipmentType] = useState('AE')
  const [numberType, setNumberType] = useState('J')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const { data, error: rpcErr } = await supabase.rpc('generate_reference_number', {
        p_shipment_type: shipmentType,
        p_number_type: numberType,
      })

      if (rpcErr) throw rpcErr
      setResult(data)
    } catch (err) {
      setError(err.message || 'Failed to generate reference number. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!result?.reference_number) return
    try {
      await navigator.clipboard.writeText(result.reference_number)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard not available
    }
  }

  const previewRef =
    numberType + 'LK' + shipmentType + 'XXXXXXX'

  const selectedShipmentLabel =
    SHIPMENT_TYPES.find((s) => s.value === shipmentType)?.label ?? shipmentType

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Hash size={20} className="text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">Generate Reference Number</h2>
          </div>
          <p className="text-gray-500 text-sm">
            Select shipment type and number type, then click Generate. Each number is unique and permanent.
          </p>
        </div>

        {/* Generator card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Shipment Type"
              value={shipmentType}
              onChange={(e) => { setShipmentType(e.target.value); setResult(null); setError('') }}
              options={SHIPMENT_TYPES}
            />
            <Select
              label="Number Type"
              value={numberType}
              onChange={(e) => { setNumberType(e.target.value); setResult(null); setError('') }}
              options={NUMBER_TYPES}
            />
          </div>

          {/* Preview hint */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm">
            <span className="text-blue-600 font-medium">Format preview: </span>
            <span className="font-mono text-blue-800 font-semibold">{previewRef}</span>
            <span className="text-blue-500 ml-2 text-xs">({selectedShipmentLabel})</span>
          </div>

          <Button
            onClick={handleGenerate}
            loading={loading}
            className="w-full py-3 text-base"
          >
            {loading ? 'Generating…' : 'Generate Reference Number'}
          </Button>

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success state */}
          {result && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 size={20} />
                <span className="font-semibold">Reference Number Generated</span>
              </div>

              {/* Big number display */}
              <div className="bg-white rounded-lg border border-green-200 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                      Reference Number
                    </p>
                    <p className="text-3xl font-bold tracking-widest text-gray-900 font-mono">
                      {result.reference_number}
                    </p>
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      copied
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Copy size={14} />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Shipment Type</p>
                  <p className="font-medium text-gray-800 mt-0.5">
                    {SHIPMENT_TYPES.find((s) => s.value === result.shipment_type)?.label}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Number Type</p>
                  <p className="font-medium text-gray-800 mt-0.5">{result.number_type_label}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Sequence #</p>
                  <p className="font-medium text-gray-800 mt-0.5">
                    #{result.sequence_number?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Generated At</p>
                  <p className="font-medium text-gray-800 mt-0.5">
                    {new Date(result.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
