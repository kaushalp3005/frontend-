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
    
    const timer = setTimeout(() => {
      window.print()
    }, 500)
    
    return () => clearTimeout(timer)
  }, [])

  // Consolidate items with same description into single rows
  const consolidatedItems = items.reduce((acc: any[], item) => {
    const desc = item.item_desc_raw || item.item_description || 'N/A'
    const existing = acc.find(i => (i.item_desc_raw || i.item_description) === desc)
    if (existing) {
      existing._totalQty = (existing._totalQty || 0) + parseFloat(item.qty || item.quantity || 0)
      existing._totalNetWeight = parseFloat(((existing._totalNetWeight || 0) + parseFloat(item.net_weight || 0)).toFixed(3))
    } else {
      acc.push({
        ...item,
        _totalQty: parseFloat(item.qty || item.quantity || 0),
        _totalNetWeight: parseFloat(parseFloat(item.net_weight || 0).toFixed(3))
      })
    }
    return acc
  }, [])

  // Split consolidated items into chunks for pagination - 15 items per page
  const itemsPerPage = 15
  const itemPages = []
  for (let i = 0; i < consolidatedItems.length; i += itemsPerPage) {
    itemPages.push(consolidatedItems.slice(i, i + itemsPerPage))
  }

  // Render DC header function
  const renderDCHeader = (pageNum: number, isLastPage: boolean) => (
    <>
      <tr>
        <td colSpan={7} style={{ 
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
        <td colSpan={4} style={{ padding: '8px', border: '1px solid #000' }}>
          <strong>Transfer No:</strong> {dcNumber}
        </td>
        <td colSpan={3} style={{ padding: '8px', border: '1px solid #000' }}>
          <strong>Date:</strong> {requestDate}
        </td>
      </tr>
      <tr>
        <td colSpan={3} style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top' }}>
          <strong>FROM: Candor Foods</strong><br />
          <div style={{ marginTop: '5px', fontSize: '11px' }}>
            <div style={{ fontWeight: 'bold' }}>{warehouseAddresses[fromWarehouse]?.name || fromWarehouse}</div>
            <div style={{ color: '#666', marginTop: '3px' }}>{warehouseAddresses[fromWarehouse]?.address || ''}</div>
          </div>
        </td>
        <td colSpan={4} style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top' }}>
          <strong>TO: Candor Foods</strong><br />
          <div style={{ marginTop: '5px', fontSize: '11px' }}>
            <div style={{ fontWeight: 'bold' }}>{warehouseAddresses[toWarehouse]?.name || toWarehouse}</div>
            <div style={{ color: '#666', marginTop: '3px' }}>{warehouseAddresses[toWarehouse]?.address || ''}</div>
          </div>
        </td>
      </tr>
      <tr>
        <td colSpan={3} style={{ padding: '8px', border: '1px solid #000' }}>
          <strong>Vehicle No:</strong> {vehicleNumber}
        </td>
        <td colSpan={4} style={{ padding: '8px', border: '1px solid #000' }}>
          <strong>Driver Name:</strong> {driverName}
        </td>
      </tr>
      <tr style={{ backgroundColor: '#e0e0e0' }}>
        <td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', width: '40px' }}>S.No</td>
        <td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', width: '250px' }}>Item Description</td>
        <td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', width: '100px' }}>Category</td>
        <td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', width: '60px' }}>Qty</td>
        <td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', width: '60px' }}>UOM</td>
        <td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', width: '80px' }}>Case Pack/Box Wt. (kg)</td>
        <td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'right', width: '100px' }}>Net Weight (in kg)</td>
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
            marginBottom: pageIndex === itemPages.length - 1 ? '20px' : '0'
          }}>
            <thead>
              {renderDCHeader(pageIndex + 1, pageIndex === itemPages.length - 1)}
            </thead>

            <tbody>
              {pageItems.map((item, itemIndex) => {
                const globalIndex = pageIndex * itemsPerPage + itemIndex
                return (
                  <tr key={globalIndex}>
                    <td style={{ padding: '6px', border: '1px solid #000', textAlign: 'center' }}>{globalIndex + 1}</td>
                    <td style={{ padding: '6px', border: '1px solid #000' }}>
                      {item.item_desc_raw || item.item_description || 'N/A'}
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #000', textAlign: 'center' }}>
                      {item.item_category || 'N/A'}
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>
                      {item._totalQty}
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #000', textAlign: 'center' }}>
                      {item.uom || 'N/A'}
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #000', textAlign: 'center' }}>
                      {item.pack_size || 'N/A'}
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #000', textAlign: 'right' }}>
                      {item._totalNetWeight}
                    </td>
                  </tr>
                )
              })}

              {/* Show summary only on last page */}
              {pageIndex === itemPages.length - 1 && (
                <>
                  <tr style={{ backgroundColor: '#f0f0f0' }}>
                    <td colSpan={3} style={{ padding: '10px', border: '1px solid #000', fontWeight: 'bold' }}>
                      Total Items: {consolidatedItems.length}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>
                      {consolidatedItems.reduce((s, i) => s + i._totalQty, 0)}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #000' }}></td>
                    <td style={{ padding: '10px', border: '1px solid #000' }}></td>
                    <td style={{ padding: '10px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold' }}>
                      {consolidatedItems.reduce((s, i) => parseFloat((s + i._totalNetWeight).toFixed(3)), 0)} kg
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} style={{ padding: '10px', border: '1px solid #000' }}>
                      <strong>Total Qty Required:</strong> {consolidatedItems.reduce((s, i) => s + i._totalQty, 0)}
                    </td>
                    <td colSpan={2} style={{ padding: '10px', border: '1px solid #000' }}>
                      <strong>Boxes Provided:</strong> {boxesProvided}
                    </td>
                    <td colSpan={2} style={{ padding: '10px', border: '1px solid #000' }}>
                      <strong>Boxes Pending:</strong> <span style={{ color: boxesPending > 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>{boxesPending}</span>
                    </td>
                  </tr>

                  <tr>
                    <td colSpan={7} style={{ padding: '10px', border: '1px solid #000' }}>
                      <strong>Reason:</strong> {reasonDescription}
                    </td>
                  </tr>

                  <tr>
                    <td colSpan={7} style={{ 
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
        pageBreakInside: 'avoid'
      }}>
        <thead>
          <tr>
            <td colSpan={4} style={{ 
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
          {/* Compact Header Info - 2 rows */}
          <tr>
            <td style={{ padding: '8px', border: '1px solid #000', width: '25%' }}>
              <strong>Transfer No:</strong> {dcNumber}
            </td>
            <td style={{ padding: '8px', border: '1px solid #000', width: '25%' }}>
              <strong>Date:</strong> {requestDate}
            </td>
            <td style={{ padding: '8px', border: '1px solid #000', width: '25%' }}>
              <strong>Vehicle:</strong> {vehicleNumber}
            </td>
            <td style={{ padding: '8px', border: '1px solid #000', width: '25%' }}>
              <strong>Driver:</strong> {driverName}
            </td>
          </tr>

          <tr>
            <td colSpan={2} style={{ padding: '8px', border: '1px solid #000' }}>
              <strong>From:</strong> {warehouseAddresses[fromWarehouse]?.name || fromWarehouse}
            </td>
            <td colSpan={2} style={{ padding: '8px', border: '1px solid #000' }}>
              <strong>To:</strong> {warehouseAddresses[toWarehouse]?.name || toWarehouse}
            </td>
          </tr>

          {/* Items Summary */}
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            <td colSpan={4} style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>
              ITEMS SUMMARY
            </td>
          </tr>
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>S.No</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold' }}>Item Description</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>Qty</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>UOM</td>
          </tr>
          {consolidatedItems.map((item, index) => (
            <tr key={index}>
              <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'center' }}>{index + 1}</td>
              <td style={{ padding: '5px', border: '1px solid #000' }}>
                {item.item_desc_raw || item.item_description || 'N/A'}
              </td>
              <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>
                {item._totalQty}
              </td>
              <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'center' }}>
                {item.uom || 'N/A'}
              </td>
            </tr>
          ))}

          {/* Summary Totals */}
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold' }}>Total Items: {consolidatedItems.length}</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold' }}>Total Qty: {consolidatedItems.reduce((s, i) => s + i._totalQty, 0)}</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold' }}>Boxes: {boxesProvided}</td>
            <td style={{ padding: '6px', border: '1px solid #000', textAlign: 'center' }}>
              <span style={{ 
                color: boxesPending > 0 ? '#dc2626' : '#16a34a', 
                fontWeight: 'bold' 
              }}>
                {boxesPending > 0 ? 'PARTIAL' : 'COMPLETE'}
              </span>
            </td>
          </tr>

          {/* Compact Signatures Section */}
          <tr>
            <td colSpan={2} style={{ padding: '25px 8px 8px 8px', border: '1px solid #000', textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '5px', marginTop: '30px' }}>
                <strong>Security Sign</strong>
              </div>
            </td>
            <td colSpan={2} style={{ padding: '25px 8px 8px 8px', border: '1px solid #000', textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '5px', marginTop: '30px' }}>
                <strong>Driver Sign</strong>
              </div>
            </td>
          </tr>

          <tr>
            <td colSpan={4} style={{ 
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
