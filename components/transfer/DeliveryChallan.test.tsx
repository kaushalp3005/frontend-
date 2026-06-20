import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import DeliveryChallan from "./DeliveryChallan"

// The component calls window.print() on a timer; stub it so jsdom doesn't throw.
beforeEach(() => {
  vi.stubGlobal("print", vi.fn())
})

const baseProps = {
  dcNumber: "TRF-1",
  requestDate: "18-06-2026",
  fromWarehouse: "W202",
  toWarehouse: "Savla D-39",
  vehicleNumber: "MH-01",
  driverName: "Driver",
  approvalAuthority: "Auth",
  reasonDescription: "Cold move",
  totalQtyRequired: 5,
  boxesProvided: 1,
  boxesPending: 0,
  warehouseAddresses: {} as Record<string, { name: string; address: string }>,
}

describe("DeliveryChallan vakkal column", () => {
  it("renders a Vakkal header and the per-item vakkal value", () => {
    render(
      <DeliveryChallan
        {...baseProps}
        items={[
          { item_description: "CASHEW", item_category: "NUTS", qty: 5, net_weight: 50, vakkal: "VK-9" },
        ]}
      />
    )
    // Header appears on both the DC table and the gate pass table.
    expect(screen.getAllByText("Vakkal").length).toBeGreaterThanOrEqual(2)
    // The value appears (once per table).
    expect(screen.getAllByText("VK-9").length).toBeGreaterThanOrEqual(2)
  })

  it("renders an em-dash when an item has no vakkal", () => {
    render(
      <DeliveryChallan
        {...baseProps}
        items={[{ item_description: "SALT", item_category: "MISC", qty: 1, net_weight: 1 }]}
      />
    )
    expect(screen.getAllByText("Vakkal").length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2)
  })
})
