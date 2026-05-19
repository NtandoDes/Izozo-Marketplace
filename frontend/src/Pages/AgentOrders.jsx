import { useEffect, useState } from "react";
import { fetchAgentOrders } from "../../api/agent";

export default function AgentOrders() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        const data = await fetchAgentOrders();
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        setItems(list);
      } catch (e) {
        console.error(e);
        setErr("Failed to load orders. Check API route + auth.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold text-izozo-brown mb-4">Orders</h2>

      {loading && <div className="bg-white p-4 rounded-xl border">Loading...</div>}
      {err && <div className="bg-white p-4 rounded-xl border text-red-600">{err}</div>}

      {!loading && !err && (
        <div className="bg-white border border-izozo-border rounded-xl p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Order</th>
                <th className="text-left py-2">Customer</th>
                <th className="text-center py-2">Status</th>
                <th className="text-center py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-b">
                  <td className="py-3 font-semibold">#{o.id}</td>
                  <td className="py-3">{o.customer_email ?? o.customer?.email ?? "-"}</td>
                  <td className="py-3 text-center">
                    <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                      {o.status ?? "—"}
                    </span>
                  </td>
                  <td className="py-3 text-center">{o.total_amount ?? o.total ?? "-"}</td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-6 text-center text-gray-500">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
