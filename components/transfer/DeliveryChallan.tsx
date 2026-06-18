"use client"

import React, { useEffect } from 'react'

interface DeliveryChallanProps {
  dcNumber: string
  requestDate: string
  fromWarehouse: string
  toWarehouse: string
  vehicleNumber: string
  driverName: string
  approvalAuthority: string
  reasonDescription: string
  items: any[]
  totalQtyRequired: number
  boxesProvided: number
  boxesPending: number
  warehouseAddresses: Record<string, { name: string; address: string }>
}

export default function DeliveryChallan({
  dcNumber,
  requestDate,
  fromWarehouse,
  toWarehouse,
  vehicleNumber,
  driverName,
  approvalAuthority,
  reasonDescription,
  items,
  totalQtyRequired,
  boxesProvided,
  boxesPending,
  warehouseAddresses
}: DeliveryChallanProps) {

  useEffect(() => {
    console.log('📄 DC Component Props:')
    console.log('- DC Number:', dcNumber)
    console.log('- Date:', requestDate)
    console.log('- From:', fromWarehouse)
    console.log('- To:', toWarehouse)
    console.log('- Vehicle:', vehicleNumber)
    console.log('- Driver:', driverName)
    console.log('- Approved By:', approvalAuthority)
    console.log('- Reason:', reasonDescription)
    console.log('- Items:', items)
    console.log('- Total Qty:', totalQtyRequired)
    console.log('- Boxes Provided:', boxesProvided)
    console.log('- Boxes Pending:', boxesPending)
    
    const timer = setTimeout(() => {
      window.print()
    }, 500)
    
    return () => clearTimeout(timer)
  }, [])

  // Determines whether an item should carry a Count value
  const isCountableItem = (item: any) => {
    const mt = (item.material_type || item.rm_pm_fg_type || "").toUpperCase()
    const cat = (item.item_category || "").toUpperCase()
    return mt === "PM" || cat === "PACKAGING"
  }

  // Check if any line has PM material type (kept for Gate Pass display)
  const hasPMItems = items.some(isCountableItem)

  // Show the Count column in the DC when PM/packaging items exist OR origin is A-68
  const fromWarehouseIsA68 =
    /(^|[^a-z])a[-\s]?68([^a-z]|$)/i.test(fromWarehouse || "") ||
    /(^|[^a-z])a[-\s]?68([^a-z]|$)/i.test(warehouseAddresses[fromWarehouse]?.name || "")
  const showCountColumn = hasPMItems || fromWarehouseIsA68

  // Compute total count (sum of unit_pack_size × qty for PM/packaging items)
  const totalPMCount = items
    .filter(isCountableItem)
    .reduce((sum: number, item: any) => {
      const packSize = parseFloat(String(item.unit_pack_size || item.pack_size || "0")) || 0
      const qty = parseFloat(String(item.qty || item.quantity || "1")) || 1
      return sum + packSize * qty
    }, 0)

  // Per-row count helper (consolidated qty × unit_pack_size)
  const itemCountFor = (item: any) => {
    if (!isCountableItem(item)) return 0
    const ups = parseFloat(String(item.unit_pack_size || item.pack_size || "0")) || 0
    const qty = parseFloat(String(item.qty || item.quantity || "1")) || 1
    return ups * qty
  }

  // Total column count for colSpan computations (default 8, +1 when Count column is visible)
  const DC_COLS = showCountColumn ? 10 : 9

  // Consolidate items: group by item description and sum quantities/weights
  const consolidatedItems = React.useMemo(() => {
    const itemMap = new Map<string, any>()

    console.log('🔄 Consolidating items, total raw items:', items.length)
    console.log('🔄 Sample item keys:', items.length > 0 ? Object.keys(items[0]) : 'none')
    console.log('🔄 Sample item:', items.length > 0 ? JSON.stringify(items[0]) : 'none')

    for (const item of items) {
      // Build key from item description (normalized) - this is the primary grouping field
      const description = (item.item_description || item.item_desc_raw || '').trim().toUpperCase()
      const category = (item.item_category || '').trim().toUpperCase()
      const packSize = item.pack_size || '0'
      const key = `${description}__${category}__${packSize}`

      if (itemMap.has(key)) {
        const existing = itemMap.get(key)
        existing.qty = (parseFloat(existing.qty) || 0) + (parseFloat(item.qty || item.quantity) || 0)
        existing.net_weight = (parseFloat(existing.net_weight) || 0) + (parseFloat(item.net_weight) || 0)
        existing.box_count += 1
      } else {
        itemMap.set(key, {
          ...item,
          qty: parseFloat(item.qty || item.quantity) || 0,
          net_weight: parseFloat(item.net_weight) || 0,
          box_count: 1,
        })
      }
    }

    console.log('🔄 Consolidated to', itemMap.size, 'unique items')
    return Array.from(itemMap.values())
  }, [items])

  // Split consolidated items into chunks for pagination - 10 items per page
  const itemsPerPage = 10
  const itemPages = []
  for (let i = 0; i < consolidatedItems.length; i += itemsPerPage) {
    itemPages.push(consolidatedItems.slice(i, i + itemsPerPage))
  }

  // Render DC header function
  const renderDCHeader = (pageNum: number, isLastPage: boolean) => (
    <>
      <tr>
        <td colSpan={DC_COLS} style={{
          textAlign: 'center',
          padding: '15px',
          borderBottom: '2px solid #000'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
            <img
              src="/candor-logo.jpg"
              alt="Candor Foods Logo"
              style={{ height: '60px', width: 'auto' }}
            />
            <div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#8B4049' }}>CANDOR FOODS</div>
              <div style={{ fontSize: '14px', marginTop: '5px', color: '#333' }}>DELIVERY CHALLAN</div>
              {pageNum > 1 && <div style={{ fontSize: '11px', marginTop: '3px', color: '#666' }}>Page {pageNum}</div>}
            </div>
          </div>
        </td>
      </tr>
      <tr>
        <td colSpan={Math.ceil(DC_COLS / 2)} style={{ padding: '8px', border: '1px solid #000' }}>
          <strong>Transfer No:</strong> {dcNumber}
        </td>
        <td colSpan={Math.floor(DC_COLS / 2)} style={{ padding: '8px', border: '1px solid #000' }}>
          <strong>Date:</strong> {requestDate}
        </td>
      </tr>
      <tr>
        <td colSpan={Math.ceil(DC_COLS / 2)} style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top' }}>
          <strong>FROM: Candor Foods</strong><br />
          <div style={{ marginTop: '5px', fontSize: '11px' }}>
            <div style={{ fontWeight: 'bold' }}>{warehouseAddresses[fromWarehouse]?.name || fromWarehouse}</div>
            <div style={{ color: '#666', marginTop: '3px' }}>{warehouseAddresses[fromWarehouse]?.address || ''}</div>
          </div>
        </td>
        <td colSpan={Math.floor(DC_COLS / 2)} style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top' }}>
          <strong>TO: Candor Foods</strong><br />
          <div style={{ marginTop: '5px', fontSize: '11px' }}>
            <div style={{ fontWeight: 'bold' }}>{warehouseAddresses[toWarehouse]?.name || toWarehouse}</div>
            <div style={{ color: '#666', marginTop: '3px' }}>{warehouseAddresses[toWarehouse]?.address || ''}</div>
          </div>
        </td>
      </tr>
      <tr>
        <td colSpan={Math.ceil(DC_COLS / 2)} style={{ padding: '8px', border: '1px solid #000' }}>
          <strong>Vehicle No:</strong> {vehicleNumber}
        </td>
        <td colSpan={Math.floor(DC_COLS / 2)} style={{ padding: '8px', border: '1px solid #000' }}>
          <strong>Driver Name:</strong> {driverName}
        </td>
      </tr>
      {showCountColumn && (
        <tr>
          <td colSpan={DC_COLS} style={{
            padding: '8px 12px', border: '1px solid #000', backgroundColor: '#fdf8f4',
            fontWeight: 'bold', fontSize: '12px', color: '#8B4049', letterSpacing: '0.3px'
          }}>
            <strong>Total Count (PM):</strong> {totalPMCount.toLocaleString('en-IN')}
          </td>
        </tr>
      )}
      <tr style={{ backgroundColor: '#e0e0e0' }}>
        <td style={{ padding: '6px 6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>S.No</td>
        <td style={{ padding: '6px 8px', border: '1px solid #000', fontWeight: 'bold', fontSize: '10.5px' }}>Item Description</td>
        <td style={{ padding: '6px 8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>Vakkal</td>
        <td style={{ padding: '6px 6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>Category</td>
        <td style={{ padding: '6px 6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>No. of Boxes</td>
        <td style={{ padding: '6px 6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>Qty</td>
        <td style={{ padding: '6px 6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>UOM</td>
        <td style={{ padding: '6px 6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>Pack Size (kg)</td>
        <td style={{ padding: '6px 6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'right', fontSize: '10.5px', whiteSpace: 'nowrap' }}>Net Wt (kg)</td>
        {showCountColumn && (
          <td style={{ padding: '6px 6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'right', fontSize: '10.5px', whiteSpace: 'nowrap' }}>Count</td>
        )}
      </tr>
    </>
  )

  return (
    <div className="w-full bg-white dc-print-content" style={{ padding: '0.5cm 1.25cm' }}>
      {/* Render DC pages with items */}
      {itemPages.map((pageItems, pageIndex) => (
        <div key={pageIndex} className="dc-page" style={{ pageBreakAfter: pageIndex < itemPages.length - 1 ? 'always' : 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            // Auto layout: every column sizes to fit its actual content.
            // Item Description is the only flexible (wrap) column; numeric
            // columns stay nowrap so they hug their values.
            tableLayout: 'auto',
            marginBottom: pageIndex === itemPages.length - 1 ? '20px' : '0'
          }}>
            <colgroup>
              {showCountColumn ? (
                <>
                  <col />
                  {/* Item Description grabs leftover space */}
                  <col style={{ width: 'auto' }} />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                </>
              ) : (
                <>
                  <col />
                  <col style={{ width: 'auto' }} />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                </>
              )}
            </colgroup>
            <thead>
              {renderDCHeader(pageIndex + 1, pageIndex === itemPages.length - 1)}
            </thead>

            <tbody>
              {pageItems.map((item, itemIndex) => {
                const globalIndex = pageIndex * itemsPerPage + itemIndex
                const rowCount = itemCountFor(item)
                return (
                  <tr key={globalIndex}>
                    <td style={{ padding: '5px 6px', border: '1px solid #000', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>{globalIndex + 1}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid #000', fontSize: '10.5px', wordBreak: 'break-word' }}>
                      {item.item_desc_raw || item.item_description || 'N/A'}
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #000', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                      {item.vakkal || '—'}
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #000', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                      {item.item_category || 'N/A'}
                    </td>
                    <td style={{ padding: '5px 6px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                      {Number(item.box_count || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '5px 6px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                      {Number(item.qty || item.quantity || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '5px 6px', border: '1px solid #000', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                      {item.uom || 'N/A'}
                    </td>
                    <td style={{ padding: '5px 6px', border: '1px solid #000', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                      {item.pack_size && item.pack_size !== '0' ? Number(item.pack_size).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : 'N/A'}
                    </td>
                    <td style={{ padding: '5px 6px', border: '1px solid #000', textAlign: 'right', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                      {Number(item.net_weight || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                    </td>
                    {showCountColumn && (
                      <td style={{ padding: '5px 6px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                        {rowCount > 0
                          ? rowCount.toLocaleString('en-IN')
                          : <span style={{ color: '#aaa', fontWeight: 'normal' }}>—</span>}
                      </td>
                    )}
                  </tr>
                )
              })}

              {/* Show summary only on last page */}
              {pageIndex === itemPages.length - 1 && (
                <>
                  {/* Totals row — each value aligns directly under its column header */}
                  <tr style={{ backgroundColor: '#f0ebe3' }}>
                    <td colSpan={4} style={{ padding: '8px 8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'right', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                      TOTAL ({consolidatedItems.length} item{consolidatedItems.length !== 1 ? 's' : ''}):
                    </td>
                    <td style={{ padding: '8px 6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                      {Number(items.length || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                      {Number(totalQtyRequired || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 6px', border: '1px solid #000', fontSize: '10.5px' }}>&nbsp;</td>
                    <td style={{ padding: '8px 6px', border: '1px solid #000', fontSize: '10.5px' }}>&nbsp;</td>
                    <td style={{ padding: '8px 6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'right', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                      {Number(consolidatedItems.reduce((s, it) => s + (parseFloat(it.net_weight as unknown as string) || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                    </td>
                    {showCountColumn && (
                      <td style={{
                        padding: '8px 6px', border: '1px solid #000',
                        fontWeight: 'bold', textAlign: 'right', fontSize: '10.5px',
                        color: '#8B4049', backgroundColor: '#fdf8f4',
                        whiteSpace: 'nowrap'
                      }}>
                        {totalPMCount > 0 ? totalPMCount.toLocaleString('en-IN') : '—'}
                      </td>
                    )}
                  </tr>

                  <tr>
                    <td colSpan={DC_COLS} style={{ padding: '10px', border: '1px solid #000' }}>
                      <strong>Reason:</strong> {reasonDescription}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={DC_COLS} style={{ padding: '10px', border: '1px solid #000', fontSize: '11px' }}>
                      <strong>Auth Sign :</strong> _________________________
                    </td>
                  </tr>

                  <tr>
                    <td colSpan={DC_COLS} style={{
                      padding: '15px 10px',
                      borderTop: '2px solid #000',
                      textAlign: 'center',
                      fontSize: '10px',
                      fontStyle: 'italic',
                      backgroundColor: '#f8f9fa'
                    }}>
                      This is a computer-generated delivery challan. No signature required.
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      ))}

      {/* Dotted separator line - only after last DC page */}
      <div style={{ 
        margin: '20px 0', 
        borderTop: '2px dashed #999',
        position: 'relative',
        pageBreakBefore: 'avoid'
      }}>
        <span style={{
          position: 'absolute',
          top: '-12px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'white',
          padding: '0 15px',
          fontSize: '12px',
          color: '#666',
          fontWeight: 'bold'
        }}>✂ CUT HERE</span>
      </div>

      {/* Gate Pass Section - Compact Version */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        marginTop: 'auto',
        pageBreakInside: 'avoid',
        tableLayout: 'fixed'
      }}>
        <colgroup>
          <col style={{ width: hasPMItems ? '6%' : '7%' }} />
          <col style={{ width: hasPMItems ? '26%' : '33%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: hasPMItems ? '14%' : '25%' }} />
          {hasPMItems && <col style={{ width: '18%' }} />}
        </colgroup>
        <thead>
          <tr>
            <td colSpan={hasPMItems ? 7 : 6} style={{
              textAlign: 'center',
              padding: '10px',
              borderBottom: '2px solid #000',
              backgroundColor: '#f0f0f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                <img 
                  src="/candor-logo.jpg" 
                  alt="Candor Foods Logo" 
                  style={{ height: '50px', width: 'auto' }}
                />
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#8B4049' }}>CANDOR FOODS - GATE PASS</div>
                </div>
              </div>
            </td>
          </tr>
        </thead>

        <tbody>
          {/* Compact Header Info - 2 rows. Total cols = 6 when PM, else 5. */}
          <tr>
            <td colSpan={2} style={{ padding: '8px', border: '1px solid #000' }}>
              <strong>Transfer No:</strong> {dcNumber}
            </td>
            <td style={{ padding: '8px', border: '1px solid #000' }}>
              <strong>Date:</strong> {requestDate}
            </td>
            <td style={{ padding: '8px', border: '1px solid #000' }}>
              <strong>Vehicle:</strong> {vehicleNumber}
            </td>
            <td colSpan={hasPMItems ? 3 : 2} style={{ padding: '8px', border: '1px solid #000' }}>
              <strong>Driver:</strong> {driverName}
            </td>
          </tr>

          <tr>
            <td colSpan={hasPMItems ? 4 : 3} style={{ padding: '8px', border: '1px solid #000' }}>
              <strong>From:</strong> Candor Foods - {warehouseAddresses[fromWarehouse]?.name || fromWarehouse}
            </td>
            <td colSpan={3} style={{ padding: '8px', border: '1px solid #000' }}>
              <strong>To:</strong> Candor Foods - {warehouseAddresses[toWarehouse]?.name || toWarehouse}
            </td>
          </tr>

          {/* Items Summary */}
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            <td colSpan={hasPMItems ? 7 : 6} style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>
              ITEMS SUMMARY
            </td>
          </tr>
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>S.No</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold' }}>Item Description</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>Vakkal</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>Boxes</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>Qty</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>Net Wt (Kg)</td>
            {hasPMItems && <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>Count</td>}
          </tr>
          {consolidatedItems.map((item, index) => {
            const isPM = (item.material_type || item.rm_pm_fg_type || "").toUpperCase() === "PM"
            const itemCount = isPM
              ? (parseFloat(String(item.unit_pack_size || item.pack_size || "0")) || 0) * (parseFloat(String(item.qty || "1")) || 1)
              : 0
            return (
              <tr key={index}>
                <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'center' }}>{index + 1}</td>
                <td style={{ padding: '5px', border: '1px solid #000' }}>
                  {item.item_desc_raw || item.item_description || 'N/A'}
                </td>
                <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'center' }}>
                  {item.vakkal || '—'}
                </td>
                <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>
                  {Number(item.box_count || 0).toLocaleString('en-IN')}
                </td>
                <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>
                  {Number(item.qty || item.quantity || 0).toLocaleString('en-IN')}
                </td>
                <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold' }}>
                  {Number(item.net_weight || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </td>
                {hasPMItems && (
                  <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold' }}>
                    {isPM && itemCount > 0
                      ? itemCount.toLocaleString('en-IN')
                      : <span style={{ color: '#aaa', fontWeight: 'normal' }}>—</span>}
                  </td>
                )}
              </tr>
            )
          })}

          {/* Summary Totals */}
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold' }}>Total Items: {consolidatedItems.length}</td>
            <td style={{ padding: '6px', border: '1px solid #000' }}>&nbsp;</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold' }}>Total Qty: {Number(totalQtyRequired || 0).toLocaleString('en-IN')}</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold' }}>Total Boxes: {Number(items.length || 0).toLocaleString('en-IN')}</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold' }}>
              Total Kg: {Number(consolidatedItems.reduce((s, it) => s + (parseFloat(it.net_weight as unknown as string) || 0), 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </td>
            <td style={{ padding: '6px', border: '1px solid #000', textAlign: 'center' }}>
              <span style={{
                color: boxesPending > 0 ? '#dc2626' : '#16a34a',
                fontWeight: 'bold'
              }}>
                {boxesPending > 0 ? 'PARTIAL' : 'COMPLETE'}
              </span>
            </td>
            {hasPMItems && (
              <td style={{
                padding: '6px', border: '1px solid #000', fontWeight: 'bold',
                textAlign: 'right', color: '#8B4049', backgroundColor: '#fdf8f4'
              }}>
                Total Count: {totalPMCount.toLocaleString('en-IN')}
              </td>
            )}
          </tr>

          {/* Compact Signatures Section */}
          <tr>
            <td colSpan={hasPMItems ? 4 : 3} style={{ padding: '25px 8px 8px 8px', border: '1px solid #000', textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '5px', marginTop: '30px' }}>
                <strong>Security Sign</strong>
              </div>
            </td>
            <td colSpan={3} style={{ padding: '25px 8px 8px 8px', border: '1px solid #000', textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '5px', marginTop: '30px' }}>
                <strong>Driver Sign</strong>
              </div>
            </td>
          </tr>

          <tr>
            <td colSpan={hasPMItems ? 7 : 6} style={{
              padding: '6px',
              border: '1px solid #000',
              textAlign: 'center',
              fontSize: '10px',
              fontStyle: 'italic',
              backgroundColor: '#f8f9fa'
            }}>
              Present this gate pass at security gate • Authorized by: {approvalAuthority}
            </td>
          </tr>
        </tbody>
      </table>

      <style jsx global>{`
        @media print {
          @page { 
            size: A4;
            margin: 0;
          }
          
          /* Hide everything on the page */
          body * {
            visibility: hidden;
          }
          
          /* Show only the DC content */
          .dc-print-content,
          .dc-print-content * {
            visibility: visible;
          }
          
          /* Position DC at top of page */
          .dc-print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          
          body { 
            margin: 0; 
            padding: 0; 
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          * {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
        }
        
        @media screen {
          body {
            background: #f5f5f5;
          }
        }
      `}</style>
    </div>
  )
}
