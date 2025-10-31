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

  return (
    <div className="w-full p-8 bg-white dc-print-content" style={{ minHeight: '100vh' }}>
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse', 
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px'
      }}>
        <thead>
          <tr>
            <td colSpan={7} style={{ 
              textAlign: 'center', 
              padding: '20px', 
              borderBottom: '2px solid #000'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                <img 
                  src="/candor-logo.jpg" 
                  alt="Candor Foods Logo" 
                  style={{ height: '80px', width: 'auto' }}
                />
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8B4049' }}>CANDOR FOODS</div>
                  <div style={{ fontSize: '16px', marginTop: '5px', color: '#333' }}>DELIVERY CHALLAN</div>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td colSpan={4} style={{ padding: '10px', border: '1px solid #000' }}>
              <strong>Transfer No:</strong> {dcNumber}
            </td>
            <td colSpan={3} style={{ padding: '10px', border: '1px solid #000' }}>
              <strong>Date:</strong> {requestDate}
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td colSpan={3} style={{ padding: '10px', border: '1px solid #000', verticalAlign: 'top' }}>
              <strong>FROM:</strong><br />
              {warehouseAddresses[fromWarehouse]?.name || fromWarehouse}<br />
              <span style={{ fontSize: '10px' }}>{warehouseAddresses[fromWarehouse]?.address || ''}</span>
            </td>
            <td colSpan={4} style={{ padding: '10px', border: '1px solid #000', verticalAlign: 'top' }}>
              <strong>TO:</strong><br />
              {warehouseAddresses[toWarehouse]?.name || toWarehouse}<br />
              <span style={{ fontSize: '10px' }}>{warehouseAddresses[toWarehouse]?.address || ''}</span>
            </td>
          </tr>

          <tr>
            <td colSpan={2} style={{ padding: '8px', border: '1px solid #000' }}>
              <strong>Vehicle:</strong> {vehicleNumber}
            </td>
            <td colSpan={3} style={{ padding: '8px', border: '1px solid #000' }}>
              <strong>Driver:</strong> {driverName}
            </td>
            <td colSpan={2} style={{ padding: '8px', border: '1px solid #000' }}>
              <strong>Approved By:</strong> {approvalAuthority}
            </td>
          </tr>

          <tr style={{ backgroundColor: '#e0e0e0' }}>
            <td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', width: '40px' }}>S.No</td>
            <td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', width: '250px' }}>Item Description</td>
            <td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', width: '100px' }}>Category</td>
            <td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', width: '60px' }}>Qty</td>
            <td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', width: '60px' }}>UOM</td>
            <td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', width: '80px' }}>Pack Size</td>
            <td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'right', width: '100px' }}>Net Weight</td>
          </tr>

          {items.map((item, index) => (
            <tr key={index}>
              <td style={{ padding: '6px', border: '1px solid #000', textAlign: 'center' }}>{index + 1}</td>
              <td style={{ padding: '6px', border: '1px solid #000' }}>
                {item.item_desc_raw || item.item_description || 'N/A'}
              </td>
              <td style={{ padding: '6px', border: '1px solid #000', textAlign: 'center' }}>
                {item.item_category || 'N/A'}
              </td>
              <td style={{ padding: '6px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>
                {item.qty || item.quantity || 0}
              </td>
              <td style={{ padding: '6px', border: '1px solid #000', textAlign: 'center' }}>
                {item.uom || 'N/A'}
              </td>
              <td style={{ padding: '6px', border: '1px solid #000', textAlign: 'center' }}>
                {item.pack_size || 'N/A'}
              </td>
              <td style={{ padding: '6px', border: '1px solid #000', textAlign: 'right' }}>
                {item.net_weight || 0}
              </td>
            </tr>
          ))}

          <tr>
            <td colSpan={3} style={{ padding: '10px', border: '1px solid #000' }}>
              <strong>Total Qty Required:</strong> {totalQtyRequired}
            </td>
            <td colSpan={2} style={{ padding: '10px', border: '1px solid #000' }}>
              <strong>Boxes Provided:</strong> {boxesProvided}
            </td>
            <td colSpan={2} style={{ padding: '10px', border: '1px solid #000' }}>
              <strong>Boxes Pending:</strong> <span style={{ color: boxesPending > 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>{boxesPending}</span>
            </td>
          </tr>

          {/* Empty Row for spacing */}
          <tr>
            <td colSpan={7} style={{ padding: '15px', border: '1px solid #000' }}>
              &nbsp;
            </td>
          </tr>

          <tr>
            <td colSpan={7} style={{ padding: '10px', border: '1px solid #000' }}>
              <strong>Reason:</strong> {reasonDescription}
            </td>
          </tr>

          <tr>
            <td colSpan={7} style={{ 
              padding: '20px 10px', 
              borderTop: '2px solid #000', 
              textAlign: 'center', 
              fontSize: '10px', 
              fontStyle: 'italic',
              backgroundColor: '#f8f9fa'
            }}>
              This is a computer-generated delivery challan. No signature required.
            </td>
          </tr>
        </tbody>
      </table>

      {/* Dotted separator line */}
      <div style={{ 
        margin: '30px 0', 
        borderTop: '2px dashed #999',
        position: 'relative'
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
        fontSize: '9px',
        marginTop: '15px',
        pageBreakInside: 'avoid'
      }}>
        <thead>
          <tr>
            <td colSpan={4} style={{ 
              textAlign: 'center', 
              padding: '8px', 
              borderBottom: '2px solid #000',
              backgroundColor: '#f0f0f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <img 
                  src="/candor-logo.jpg" 
                  alt="Candor Foods Logo" 
                  style={{ height: '35px', width: 'auto' }}
                />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#8B4049' }}>CANDOR FOODS - GATE PASS</div>
                </div>
              </div>
            </td>
          </tr>
        </thead>

        <tbody>
          {/* Compact Header Info - 2 rows */}
          <tr>
            <td style={{ padding: '5px', border: '1px solid #000', width: '25%' }}>
              <strong>Transfer No:</strong> {dcNumber}
            </td>
            <td style={{ padding: '5px', border: '1px solid #000', width: '25%' }}>
              <strong>Date:</strong> {requestDate}
            </td>
            <td style={{ padding: '5px', border: '1px solid #000', width: '25%' }}>
              <strong>Vehicle:</strong> {vehicleNumber}
            </td>
            <td style={{ padding: '5px', border: '1px solid #000', width: '25%' }}>
              <strong>Driver:</strong> {driverName}
            </td>
          </tr>

          <tr>
            <td colSpan={2} style={{ padding: '5px', border: '1px solid #000' }}>
              <strong>From:</strong> {warehouseAddresses[fromWarehouse]?.name || fromWarehouse}
            </td>
            <td colSpan={2} style={{ padding: '5px', border: '1px solid #000' }}>
              <strong>To:</strong> {warehouseAddresses[toWarehouse]?.name || toWarehouse}
            </td>
          </tr>

          {/* Items Summary */}
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            <td colSpan={4} style={{ padding: '5px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>
              ITEMS SUMMARY
            </td>
          </tr>
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            <td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>S.No</td>
            <td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>Item Description</td>
            <td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>Qty</td>
            <td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>UOM</td>
          </tr>
          {items.slice(0, 5).map((item, index) => (
            <tr key={index}>
              <td style={{ padding: '3px', border: '1px solid #000', textAlign: 'center' }}>{index + 1}</td>
              <td style={{ padding: '3px', border: '1px solid #000' }}>
                {item.item_desc_raw || item.item_description || 'N/A'}
              </td>
              <td style={{ padding: '3px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>
                {item.qty || item.quantity || 0}
              </td>
              <td style={{ padding: '3px', border: '1px solid #000', textAlign: 'center' }}>
                {item.uom || 'N/A'}
              </td>
            </tr>
          ))}
          {items.length > 5 && (
            <tr>
              <td colSpan={4} style={{ padding: '3px', border: '1px solid #000', textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                ... and {items.length - 5} more items (See Delivery Challan above for full details)
              </td>
            </tr>
          )}

          {/* Summary Totals */}
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            <td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>Total Items: {items.length}</td>
            <td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>Total Qty: {totalQtyRequired}</td>
            <td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>Boxes: {boxesProvided}</td>
            <td style={{ padding: '4px', border: '1px solid #000', textAlign: 'center' }}>
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
            <td colSpan={2} style={{ padding: '20px 5px 5px 5px', border: '1px solid #000', textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '3px', marginTop: '25px' }}>
                <strong>Security Sign</strong>
              </div>
            </td>
            <td colSpan={2} style={{ padding: '20px 5px 5px 5px', border: '1px solid #000', textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '3px', marginTop: '25px' }}>
                <strong>Driver Sign</strong>
              </div>
            </td>
          </tr>

          <tr>
            <td colSpan={4} style={{ 
              padding: '5px', 
              border: '1px solid #000',
              textAlign: 'center',
              fontSize: '8px',
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
            margin: 0.5in;
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
