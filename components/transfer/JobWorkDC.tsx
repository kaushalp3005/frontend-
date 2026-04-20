"use client"

import React, { useEffect } from 'react'

interface JobWorkDCProps {
  challanNo: string
  dated: string
  fromWarehouse: string
  eWayBillNo?: string
  dispatchedThrough?: string
  motorVehicleNo: string
  driverName: string
  authorizedPerson: string
  purposeOfWork: string
  remarks?: string
  expectedReturnDate?: string
  company: {
    name: string
    address: string
    gstin: string
    fssai_no: string
    state: string
    state_code: string
    email: string
  }
  dispatchTo: {
    name: string
    address: string
    state?: string
    city?: string
    pin_code?: string
    contact_company?: string
    contact_mobile?: string
    email?: string
    sub_category?: string
  }
  lineItems: Array<{
    sl_no: number
    item_description: string
    hsn_sac: string
    gst_rate: string
    material_type?: string
    item_category?: string
    sub_category?: string
    uom?: string
    unit_pack_size?: string
    quantity_boxes: number
    net_weight: number
    total_weight: number
    lot_number?: string
    rate_per_kg?: number
    amount?: number
    remarks?: string
  }>
  totals: {
    total_quantity_kgs: number
    total_boxes: number
    total_amount: number
  }
}

export default function JobWorkDC(props: JobWorkDCProps) {
  const {
    challanNo, dated, fromWarehouse, eWayBillNo, dispatchedThrough,
    motorVehicleNo, driverName, authorizedPerson, purposeOfWork,
    remarks, expectedReturnDate, company, dispatchTo, lineItems, totals
  } = props

  useEffect(() => {
    const timer = setTimeout(() => { window.print() }, 600)
    return () => clearTimeout(timer)
  }, [])

  const ITEMS_PER_PAGE = 8
  const pages: typeof lineItems[] = []
  for (let i = 0; i < lineItems.length; i += ITEMS_PER_PAGE) {
    pages.push(lineItems.slice(i, i + ITEMS_PER_PAGE))
  }

  const cellStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '6px 8px', border: '1px solid #333', fontSize: '11px', ...extra
  })

  const headerCell = (extra?: React.CSSProperties): React.CSSProperties => ({
    ...cellStyle(extra), fontWeight: 'bold', backgroundColor: '#f0ebe3', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.3px'
  })

  const renderHeader = (pageNum: number) => (
    <>
      {/* Company Header */}
      <tr>
        <td colSpan={7} style={{ padding: '0', borderBottom: '2px solid #8B4049' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 15px', backgroundColor: '#fdf8f4' }}>
            <img src="/candor-logo.jpg" alt="Logo" style={{ height: '55px', width: 'auto', marginRight: '18px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#8B4049', letterSpacing: '1px' }}>CANDOR DATES PRIVATE LIMITED</div>
              <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{company.address}</div>
              <div style={{ fontSize: '10px', color: '#555', marginTop: '1px' }}>
                GSTIN: {company.gstin} | FSSAI: {company.fssai_no} | Email: {company.email}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#8B4049', border: '2px solid #8B4049', padding: '4px 14px', borderRadius: '4px' }}>DELIVERY CHALLAN</div>
              <div style={{ fontSize: '9px', color: '#888', marginTop: '3px' }}>Job Work - Material Out</div>
              {pageNum > 1 && <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>Page {pageNum} of {pages.length}</div>}
            </div>
          </div>
        </td>
      </tr>

      {/* Challan Info Row */}
      <tr>
        <td colSpan={2} style={cellStyle({ backgroundColor: '#f9f7f4' })}>
          <strong>Challan No:</strong> <span style={{ color: '#8B4049', fontWeight: 'bold', fontSize: '12px' }}>{challanNo}</span>
        </td>
        <td colSpan={2} style={cellStyle({ backgroundColor: '#f9f7f4' })}>
          <strong>Date:</strong> {dated}
        </td>
        <td colSpan={1} style={cellStyle({ backgroundColor: '#f9f7f4' })}>
          <strong>E-Way Bill:</strong> {eWayBillNo || 'N/A'}
        </td>
        <td colSpan={2} style={cellStyle({ backgroundColor: '#f9f7f4' })}>
          <strong>Vehicle No:</strong> {motorVehicleNo}
        </td>
      </tr>

      {/* From / To */}
      <tr>
        <td colSpan={4} style={cellStyle({ verticalAlign: 'top' })}>
          <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#8B4049', marginBottom: '4px', textTransform: 'uppercase' }}>CONSIGNOR (From)</div>
          <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{company.name}</div>
          <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>Warehouse: {fromWarehouse}</div>
          <div style={{ fontSize: '10px', color: '#555' }}>{company.address}</div>
          <div style={{ fontSize: '10px', color: '#555' }}>State: {company.state} ({company.state_code}) | GSTIN: {company.gstin}</div>
        </td>
        <td colSpan={3} style={cellStyle({ verticalAlign: 'top' })}>
          <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#8B4049', marginBottom: '4px', textTransform: 'uppercase' }}>CONSIGNEE (Dispatch To)</div>
          <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{dispatchTo.name}</div>
          <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{dispatchTo.address}</div>
          {dispatchTo.city && <div style={{ fontSize: '10px', color: '#555' }}>{dispatchTo.city}{dispatchTo.pin_code ? ` - ${dispatchTo.pin_code}` : ''}</div>}
          {dispatchTo.state && <div style={{ fontSize: '10px', color: '#555' }}>State: {dispatchTo.state}</div>}
          {dispatchTo.contact_mobile && <div style={{ fontSize: '10px', color: '#555' }}>Contact: {dispatchTo.contact_mobile}</div>}
        </td>
      </tr>

      {/* Purpose & Transport */}
      <tr>
        <td colSpan={4} style={cellStyle()}>
          <strong>Purpose of Work:</strong> {purposeOfWork}{dispatchTo.sub_category ? ` — ${dispatchTo.sub_category}` : ''}
        </td>
        <td colSpan={3} style={cellStyle()}>
          <strong>Driver:</strong> {driverName}
          {dispatchedThrough && <span style={{ marginLeft: '10px' }}>| <strong>Dispatched Through:</strong> {dispatchedThrough}</span>}
        </td>
      </tr>

      {/* Column Headers */}
      <tr>
        <td style={headerCell({ textAlign: 'center', width: '35px' })}>S.No</td>
        <td style={headerCell({ width: '250px' })}>Item Description</td>
        <td style={headerCell({ textAlign: 'center', width: '65px' })}>Lot No</td>
        <td style={headerCell({ textAlign: 'center', width: '55px' })}>UOM</td>
        <td style={headerCell({ textAlign: 'center', width: '60px' })}>Case Pack</td>
        <td style={headerCell({ textAlign: 'center', width: '55px' })}>Boxes</td>
        <td style={headerCell({ textAlign: 'right', width: '85px' })}>Net Wt (Kg)</td>
      </tr>
    </>
  )

  return (
    <div className="w-full bg-white jw-dc-print" style={{ padding: '0.5cm 1cm' }}>
      {/* ═══════ DELIVERY CHALLAN PAGES ═══════ */}
      {pages.map((pageItems, pageIdx) => {
        const isLast = pageIdx === pages.length - 1
        return (
          <div key={pageIdx} style={{ pageBreakAfter: isLast ? 'auto' : 'always' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: '11px' }}>
              <thead>{renderHeader(pageIdx + 1)}</thead>
              <tbody>
                {pageItems.map((item, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafaf7' }}>
                    <td style={cellStyle({ textAlign: 'center' })}>{item.sl_no}</td>
                    <td style={cellStyle()}>
                      <div style={{ fontWeight: '600' }}>{item.item_description}</div>
                      {item.item_category && <div style={{ fontSize: '9px', color: '#888', marginTop: '1px' }}>{item.material_type} / {item.item_category}{item.sub_category ? ` / ${item.sub_category}` : ''}</div>}
                    </td>
                    <td style={cellStyle({ textAlign: 'center', fontFamily: 'monospace' })}>{item.lot_number || '-'}</td>
                    <td style={cellStyle({ textAlign: 'center' })}>{item.uom || 'KG'}</td>
                    <td style={cellStyle({ textAlign: 'center' })}>{item.unit_pack_size || '-'}</td>
                    <td style={cellStyle({ textAlign: 'center', fontWeight: 'bold' })}>{item.quantity_boxes}</td>
                    <td style={cellStyle({ textAlign: 'right', fontWeight: 'bold' })}>{item.net_weight.toFixed(3)}</td>
                  </tr>
                ))}

                {/* Fill empty rows on last page for consistent height */}
                {isLast && pageItems.length < ITEMS_PER_PAGE && Array.from({ length: ITEMS_PER_PAGE - pageItems.length }).map((_, k) => (
                  <tr key={`empty-${k}`}>
                    {Array.from({ length: 7 }).map((_, c) => (
                      <td key={c} style={cellStyle({ height: '22px' })}>&nbsp;</td>
                    ))}
                  </tr>
                ))}

                {/* Totals - only on last page */}
                {isLast && (
                  <>
                    <tr style={{ backgroundColor: '#f0ebe3' }}>
                      <td colSpan={5} style={cellStyle({ fontWeight: 'bold', textAlign: 'right', fontSize: '11px' })}>TOTAL</td>
                      <td style={cellStyle({ textAlign: 'center', fontWeight: 'bold', fontSize: '12px' })}>{totals.total_boxes}</td>
                      <td style={cellStyle({ textAlign: 'right', fontWeight: 'bold', fontSize: '12px' })}>{totals.total_quantity_kgs.toFixed(3)}</td>
                    </tr>

                    {/* Remarks & Notes */}
                    <tr>
                      <td colSpan={7} style={cellStyle({ verticalAlign: 'top' })}>
                        {remarks && (
                          <div style={{ marginBottom: '6px' }}>
                            <strong>Remarks:</strong> {remarks}
                          </div>
                        )}
                        {expectedReturnDate && (
                          <div style={{ marginBottom: '6px' }}>
                            <strong>Expected Return:</strong> {expectedReturnDate}
                          </div>
                        )}
                        <div style={{ fontSize: '10px', color: '#888', marginTop: '6px', fontStyle: 'italic' }}>
                          Note: Goods sent on job work basis. Materials remain the property of {company.name} until processed and returned.
                        </div>
                      </td>
                    </tr>

                    {/* Signatures */}
                    <tr>
                      <td colSpan={2} style={cellStyle({ textAlign: 'center', height: '70px', verticalAlign: 'bottom' })}>
                        <div style={{ borderTop: '1px solid #333', paddingTop: '4px', marginTop: '40px', fontSize: '10px' }}>
                          <strong>Prepared By</strong>
                        </div>
                      </td>
                      <td colSpan={3} style={cellStyle({ textAlign: 'center', height: '70px', verticalAlign: 'bottom' })}>
                        <div style={{ borderTop: '1px solid #333', paddingTop: '4px', marginTop: '40px', fontSize: '10px' }}>
                          <strong>Received By (Party)</strong>
                        </div>
                      </td>
                      <td colSpan={2} style={cellStyle({ textAlign: 'center', height: '70px', verticalAlign: 'bottom' })}>
                        <div style={{ borderTop: '1px solid #333', paddingTop: '4px', marginTop: '40px', fontSize: '10px' }}>
                          <strong>Authorized Signatory</strong><br />
                          <span style={{ fontSize: '9px', color: '#666' }}>{authorizedPerson}</span>
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td colSpan={7} style={{
                        padding: '8px', textAlign: 'center', fontSize: '9px', fontStyle: 'italic',
                        color: '#888', backgroundColor: '#fdf8f4', borderTop: '2px solid #8B4049'
                      }}>
                        This is a computer-generated Delivery Challan for Job Work (Material Out) under GST provisions. No signature required for digital copy.
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )
      })}

      {/* ═══════ CUT LINE ═══════ */}
      <div style={{ margin: '25px 0', borderTop: '2px dashed #999', position: 'relative', pageBreakBefore: 'avoid' }}>
        <span style={{
          position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'white', padding: '0 15px', fontSize: '11px', color: '#666', fontWeight: 'bold'
        }}>&#9986; CUT HERE - GATE PASS BELOW</span>
      </div>

      {/* ═══════ GATE PASS ═══════ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: '11px', pageBreakInside: 'avoid' }}>
        <thead>
          <tr>
            <td colSpan={6} style={{ padding: '10px 15px', borderBottom: '2px solid #8B4049', backgroundColor: '#fdf8f4' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                <img src="/candor-logo.jpg" alt="Logo" style={{ height: '40px', width: 'auto' }} />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#8B4049', letterSpacing: '2px' }}>GATE PASS</div>
                  <div style={{ fontSize: '9px', color: '#888' }}>Job Work - Material Out</div>
                </div>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          {/* Gate Pass Info */}
          <tr>
            <td style={cellStyle({ width: '33%' })}><strong>Challan No:</strong> {challanNo}</td>
            <td style={cellStyle({ width: '17%' })}><strong>Date:</strong> {dated}</td>
            <td style={cellStyle({ width: '17%' })}><strong>Vehicle:</strong> {motorVehicleNo}</td>
            <td style={cellStyle({ width: '17%' })}><strong>Driver:</strong> {driverName}</td>
            <td colSpan={2} style={cellStyle({ width: '16%' })}><strong>From:</strong> {fromWarehouse}</td>
          </tr>
          <tr>
            <td colSpan={3} style={cellStyle()}><strong>Dispatch To:</strong> {dispatchTo.name}</td>
            <td colSpan={3} style={cellStyle()}><strong>Purpose:</strong> {purposeOfWork}</td>
          </tr>

          {/* Items Summary Header */}
          <tr style={{ backgroundColor: '#f0ebe3' }}>
            <td colSpan={6} style={cellStyle({ fontWeight: 'bold', textAlign: 'center', fontSize: '10px', letterSpacing: '1px' })}>MATERIAL SUMMARY</td>
          </tr>
          <tr style={{ backgroundColor: '#f8f6f3' }}>
            <td style={headerCell({ textAlign: 'center', width: '30px' })}>S.No</td>
            <td style={headerCell()}>Item Description</td>
            <td style={headerCell({ textAlign: 'center' })}>Lot No</td>
            <td style={headerCell({ textAlign: 'center' })}>Boxes</td>
            <td style={headerCell({ textAlign: 'right' })}>Net Wt (Kg)</td>
            <td style={headerCell({ textAlign: 'right' })}>Total Wt (Kg)</td>
          </tr>

          {/* Show up to 6 items in gate pass */}
          {lineItems.slice(0, 6).map((item, idx) => (
            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafaf7' }}>
              <td style={cellStyle({ textAlign: 'center' })}>{item.sl_no}</td>
              <td style={cellStyle({ fontWeight: '600' })}>{item.item_description}</td>
              <td style={cellStyle({ textAlign: 'center', fontFamily: 'monospace' })}>{item.lot_number || '-'}</td>
              <td style={cellStyle({ textAlign: 'center', fontWeight: 'bold' })}>{item.quantity_boxes}</td>
              <td style={cellStyle({ textAlign: 'right', fontWeight: 'bold' })}>{item.net_weight.toFixed(3)}</td>
              <td style={cellStyle({ textAlign: 'right' })}>{item.total_weight.toFixed(3)}</td>
            </tr>
          ))}
          {lineItems.length > 6 && (
            <tr>
              <td colSpan={6} style={cellStyle({ textAlign: 'center', fontStyle: 'italic', color: '#666', fontSize: '10px' })}>
                ... and {lineItems.length - 6} more item(s) - refer Delivery Challan for full details
              </td>
            </tr>
          )}

          {/* Gate Pass Totals */}
          <tr style={{ backgroundColor: '#f0ebe3' }}>
            <td colSpan={2} style={cellStyle({ fontWeight: 'bold' })}>Total Items: {lineItems.length}</td>
            <td style={cellStyle({ fontWeight: 'bold', textAlign: 'center' })}></td>
            <td style={cellStyle({ fontWeight: 'bold', textAlign: 'center' })}>{totals.total_boxes}</td>
            <td style={cellStyle({ fontWeight: 'bold', textAlign: 'right' })}>{totals.total_quantity_kgs.toFixed(3)}</td>
            <td style={cellStyle({ fontWeight: 'bold', textAlign: 'right' })}>{lineItems.reduce((s, e) => s + e.total_weight, 0).toFixed(3)}</td>
          </tr>

          {/* Signatures */}
          <tr>
            <td colSpan={2} style={cellStyle({ textAlign: 'center', height: '60px', verticalAlign: 'bottom' })}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '4px', marginTop: '35px', fontSize: '10px' }}>
                <strong>Security Sign & Stamp</strong>
              </div>
            </td>
            <td colSpan={2} style={cellStyle({ textAlign: 'center', height: '60px', verticalAlign: 'bottom' })}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '4px', marginTop: '35px', fontSize: '10px' }}>
                <strong>Driver Sign</strong>
              </div>
            </td>
            <td colSpan={2} style={cellStyle({ textAlign: 'center', height: '60px', verticalAlign: 'bottom' })}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '4px', marginTop: '35px', fontSize: '10px' }}>
                <strong>Authorized By</strong><br />
                <span style={{ fontSize: '9px', color: '#666' }}>{authorizedPerson}</span>
              </div>
            </td>
          </tr>

          {/* Footer */}
          <tr>
            <td colSpan={6} style={{
              padding: '6px', textAlign: 'center', fontSize: '9px', fontStyle: 'italic',
              color: '#888', backgroundColor: '#fdf8f4', borderTop: '2px solid #8B4049'
            }}>
              Present this gate pass at security gate | {company.name} | Challan: {challanNo}
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
          body * { visibility: hidden; }
          .jw-dc-print, .jw-dc-print * { visibility: visible; }
          .jw-dc-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
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
          body { background: #e8e4df; }
        }
      `}</style>
    </div>
  )
}
